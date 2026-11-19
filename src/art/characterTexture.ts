import Phaser from 'phaser';
import type { Appearance } from '../game/types';
import { buildCharacter, expand, opPixels, OUTLINE_COLOR, SPRITE_H, SPRITE_W, type Facing } from './character';

/**
 * Builds (once) a pixel-art texture for this look and returns its key.
 * Uses rectangles only, so the result is crisp; nearest-neighbour filtering keeps it crisp when scaled.
 */
export function ensureCharacterTexture(scene: Phaser.Scene, appearance: Appearance, facing: Facing): string {
  const key = `char:${facing}:${JSON.stringify(appearance)}`;
  if (scene.textures.exists(key)) return key;

  const ops = buildCharacter(appearance, facing);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Pass 1: dark outline (every shape grown by 1px), pass 2: the fills on top.
  g.fillStyle(OUTLINE_COLOR, 1);
  for (const op of ops) {
    for (const r of opPixels(expand(op, 1))) g.fillRect(r.x, r.y, r.w, r.h);
  }
  for (const op of ops) {
    g.fillStyle(op.color, 1);
    for (const r of opPixels(op)) g.fillRect(r.x, r.y, r.w, r.h);
  }

  g.generateTexture(key, SPRITE_W, SPRITE_H);
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}
