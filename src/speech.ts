import Phaser from 'phaser';
import type { Appearance } from './game/types';
import { addToonHead } from './art/toonTexture';
import { drawCard, TC, themeText } from './theme';

export interface Talk {
  /** Shows the whole line at once. */
  skip(): void;
  isDone(): boolean;
  destroy(): void;
}

export interface TalkOptions {
  appearance: Appearance;
  name: string;
  line: string;
  /** 'below': a big head with the speech bubble under it (tail up). 'side': a small head on the left, the bubble on its right (tail left). */
  layout: 'below' | 'side';
  /** Layout 'below': centre x and top y of the head. Layout 'side': left x and top y of the whole row. */
  x: number;
  y: number;
  /** Width of the head portrait and of the bubble. */
  headWidth: number;
  bubbleWidth: number;
  textSize?: number;
  depth?: number;
  onDone?: () => void;
}

const MS_PER_CHAR = 34;

/**
 * A rival's head with a speech bubble. The line is typed letter by letter and the head bobs while he talks. The text is wrapped before it
 * is typed, so words never jump to the next line in the middle of typing.
 */
export function rivalTalk(scene: Phaser.Scene, o: TalkOptions): Talk {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const depth = o.depth ?? 0;
  const keep = <T extends Phaser.GameObjects.GameObject>(g: T): T => {
    (g as unknown as { setDepth: (d: number) => unknown }).setDepth(depth);
    objs.push(g);
    return g;
  };
  const size = o.textSize ?? 15;
  const pad = 12;
  const HEAD_CROP = 0.9; // down to the chin and the start of the shoulders (lower, the racket arm shows)
  const headH = o.headWidth * 1.04 * HEAD_CROP;
  // Measure the wrapped line first.
  const probe = themeText(scene, 0, 0, o.line, { size, origin: [0, 0] }).setWordWrapWidth(o.bubbleWidth - pad * 2).setVisible(false);
  const lines = probe.getWrappedText(o.line);
  probe.destroy();
  const wrapped = lines.join('\n');
  const nameH = size + 4;
  const textH = lines.length * (size * 1.32) + 4;
  const bubbleH = pad * 2 + nameH + textH;

  const headCx = o.layout === 'below' ? o.x : o.x + o.headWidth / 2;
  const head = keep(addToonHead(scene, headCx, o.y, o.headWidth, o.appearance, 'front', HEAD_CROP));
  const headY = head.y;
  const bx = o.layout === 'below' ? o.x - o.bubbleWidth / 2 : o.x + o.headWidth + 12;
  const by = o.layout === 'below' ? o.y + headH + 14 : o.y + Math.max(0, (headH - bubbleH) / 2);
  const g = keep(scene.add.graphics().setPosition(bx, by));
  drawCard(g, o.bubbleWidth, bubbleH, { radius: 14, shadow: 3 });
  // Tail: white over the card's outline, outlined on its two outer sides.
  const tail = keep(scene.add.graphics());
  if (o.layout === 'below') {
    const tx = o.x;
    tail.fillStyle(TC.white, 1).fillTriangle(tx - 11, by + 2, tx + 11, by + 2, tx, by - 13);
    tail.lineStyle(2.5, TC.navy, 1).lineBetween(tx - 11, by + 1, tx, by - 13).lineBetween(tx + 11, by + 1, tx, by - 13);
  } else {
    const ty = by + Math.min(bubbleH - 14, Math.max(14, headH * 0.45));
    tail.fillStyle(TC.white, 1).fillTriangle(bx + 2, ty - 9, bx + 2, ty + 9, bx - 12, ty);
    tail.lineStyle(2.5, TC.navy, 1).lineBetween(bx + 1, ty - 9, bx - 12, ty).lineBetween(bx + 1, ty + 9, bx - 12, ty);
  }
  keep(themeText(scene, bx + pad, by + pad + nameH / 2, o.name.split(' ')[0].toUpperCase(), { size: size - 3, color: TC.orange, font: 'display', origin: [0, 0.5] }));
  const text = keep(themeText(scene, bx + pad, by + pad + nameH, '', { size, origin: [0, 0] }));
  text.setLineSpacing(size * 0.32 - 2);

  let shown = 0;
  let done = false;
  let bob: Phaser.Tweens.Tween | null = null;
  const finish = (): void => {
    if (done) return;
    done = true;
    timer.remove();
    text.setText(wrapped);
    bob?.stop();
    head.setY(headY).setScale(head.scaleX);
    o.onDone?.();
  };
  // The number of letters follows the clock (not the number of ticks), so a slow phone types at the same speed as a fast one.
  const startedAt = scene.time.now;
  const timer = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      const n = Math.min(wrapped.length, Math.floor((scene.time.now - startedAt) / MS_PER_CHAR));
      if (n !== shown) {
        shown = n;
        text.setText(wrapped.slice(0, shown));
      }
      if (shown >= wrapped.length) finish();
    },
  });
  bob = scene.tweens.add({ targets: head, y: headY - 3, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  return {
    skip: finish,
    isDone: () => done,
    destroy: () => {
      timer.remove();
      bob?.stop();
      for (const ob of objs) ob.destroy();
    },
  };
}
